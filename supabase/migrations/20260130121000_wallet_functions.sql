-- =============================================
-- WALLET FUNCTIONS FOR TRANSACTION MANAGEMENT
-- =============================================

-- Function to confirm transaction and update user balance
CREATE OR REPLACE FUNCTION public.confirm_transaction(
  p_transaction_id UUID,
  p_user_id UUID
) RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  tx_record RECORD;
  current_balance DECIMAL;
  current_frozen_balance DECIMAL;
BEGIN
  -- Get transaction details
  SELECT * INTO tx_record
  FROM public.transactions
  WHERE id = p_transaction_id AND user_id = p_user_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Transaction not found';
  END IF;
  
  IF tx_record.status != 'pending' THEN
    RAISE EXCEPTION 'Transaction is not pending';
  END IF;
  
  -- Get current user balance
  SELECT balance, frozen_balance INTO current_balance, current_frozen_balance
  FROM public.profiles
  WHERE user_id = p_user_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'User profile not found';
  END IF;
  
  -- Process transaction based on type
  CASE tx_record.type
    WHEN 'deposit' THEN
      -- Add to balance
      UPDATE public.profiles
      SET balance = balance + tx_record.amount
      WHERE user_id = p_user_id;
      
    WHEN 'withdraw' THEN
      -- Check sufficient balance
      IF current_balance < tx_record.amount THEN
        UPDATE public.transactions
        SET status = 'failed'
        WHERE id = p_transaction_id;
        RAISE EXCEPTION 'Insufficient balance';
      END IF;
      
      -- Subtract from balance
      UPDATE public.profiles
      SET balance = balance - tx_record.amount
      WHERE user_id = p_user_id;
      
    WHEN 'freeze' THEN
      -- Check sufficient available balance
      IF (current_balance - current_frozen_balance) < tx_record.amount THEN
        UPDATE public.transactions
        SET status = 'failed'
        WHERE id = p_transaction_id;
        RAISE EXCEPTION 'Insufficient available balance';
      END IF;
      
      -- Add to frozen balance
      UPDATE public.profiles
      SET frozen_balance = frozen_balance + tx_record.amount
      WHERE user_id = p_user_id;
      
    WHEN 'release' THEN
      -- Check sufficient frozen balance
      IF current_frozen_balance < tx_record.amount THEN
        UPDATE public.transactions
        SET status = 'failed'
        WHERE id = p_transaction_id;
        RAISE EXCEPTION 'Insufficient frozen balance';
      END IF;
      
      -- Subtract from frozen balance
      UPDATE public.profiles
      SET frozen_balance = frozen_balance - tx_record.amount
      WHERE user_id = p_user_id;
      
    WHEN 'commission' THEN
      -- Subtract from balance (commission is deducted from earnings)
      IF current_balance < tx_record.amount THEN
        UPDATE public.transactions
        SET status = 'failed'
        WHERE id = p_transaction_id;
        RAISE EXCEPTION 'Insufficient balance for commission';
      END IF;
      
      -- Subtract commission from balance
      UPDATE public.profiles
      SET balance = balance - tx_record.amount
      WHERE user_id = p_user_id;
      
    WHEN 'subscription_payment' THEN
      -- Check sufficient balance
      IF current_balance < tx_record.amount THEN
        UPDATE public.transactions
        SET status = 'failed'
        WHERE id = p_transaction_id;
        RAISE EXCEPTION 'Insufficient balance for subscription';
      END IF;
      
      -- Subtract from balance
      UPDATE public.profiles
      SET balance = balance - tx_record.amount
      WHERE user_id = p_user_id;
      
    WHEN 'fast_withdraw' THEN
      -- Check sufficient balance
      IF current_balance < tx_record.amount THEN
        UPDATE public.transactions
        SET status = 'failed'
        WHERE id = p_transaction_id;
        RAISE EXCEPTION 'Insufficient balance for fast withdraw';
      END IF;
      
      -- Subtract from balance
      UPDATE public.profiles
      SET balance = balance - tx_record.amount
      WHERE user_id = p_user_id;
      
    WHEN 'refund' THEN
      -- Add to balance
      UPDATE public.profiles
      SET balance = balance + tx_record.amount
      WHERE user_id = p_user_id;
      
    WHEN 'bonus' THEN
      -- Add to balance
      UPDATE public.profiles
      SET balance = balance + tx_record.amount
      WHERE user_id = p_user_id;
      
    ELSE
      RAISE EXCEPTION 'Unknown transaction type: %', tx_record.type;
  END CASE;
  
  -- Update transaction status
  UPDATE public.transactions
  SET status = 'confirmed',
      confirmed_at = now()
  WHERE id = p_transaction_id;
  
  RETURN TRUE;
END;
$$;

-- Function to get user balance summary
CREATE OR REPLACE FUNCTION public.get_user_balance_summary(
  p_user_id UUID
) RETURNS TABLE(
  balance DECIMAL,
  frozen_balance DECIMAL,
  available_balance DECIMAL,
  total_transactions BIGINT,
  last_transaction_date TIMESTAMP WITH TIME ZONE
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    p.balance,
    p.frozen_balance,
    p.balance - p.frozen_balance as available_balance,
    COUNT(t.id) as total_transactions,
    MAX(t.created_at) as last_transaction_date
  FROM public.profiles p
  LEFT JOIN public.transactions t ON p.user_id = t.user_id AND t.status = 'confirmed'
  WHERE p.user_id = p_user_id
  GROUP BY p.balance, p.frozen_balance;
$$;

-- Function to update user turnover (for commission levels)
CREATE OR REPLACE FUNCTION public.update_user_turnover(p_user_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  total_turnover DECIMAL;
BEGIN
  -- Calculate turnover from completed deals in last 30 days
  SELECT COALESCE(SUM(agreed_price), 0) INTO total_turnover
  FROM public.deals d
  WHERE d.carrier_id = p_user_id
    AND d.status = 'delivered'
    AND d.completed_at >= now() - interval '30 days';
  
  -- Update user profile
  UPDATE public.profiles
  SET turnover_30_days = total_turnover
  WHERE user_id = p_user_id;
  
  -- Update commission level based on new turnover
  PERFORM public.update_user_commission_level(p_user_id);
END;
$$;

-- Function to process withdrawal with validation
CREATE OR REPLACE FUNCTION public.process_withdrawal(
  p_user_id UUID,
  p_amount DECIMAL,
  p_description TEXT DEFAULT NULL,
  p_idempotency_key TEXT DEFAULT NULL
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_balance DECIMAL;
  min_withdraw DECIMAL;
  max_withdraw DECIMAL;
  transaction_id UUID;
BEGIN
  -- Get current balance
  SELECT balance INTO current_balance
  FROM public.profiles
  WHERE user_id = p_user_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'User not found';
  END IF;
  
  -- Get withdrawal limits
  SELECT (value::text)::DECIMAL INTO min_withdraw
  FROM public.platform_settings
  WHERE key = 'min_withdraw_amount';
  
  SELECT (value::text)::DECIMAL INTO max_withdraw
  FROM public.platform_settings
  WHERE key = 'max_withdraw_amount';
  
  -- Validate amount
  IF p_amount < min_withdraw THEN
    RAISE EXCEPTION 'Amount is below minimum withdrawal limit';
  END IF;
  
  IF p_amount > max_withdraw THEN
    RAISE EXCEPTION 'Amount exceeds maximum withdrawal limit';
  END IF;
  
  IF current_balance < p_amount THEN
    RAISE EXCEPTION 'Insufficient balance';
  END IF;
  
  -- Create transaction
  INSERT INTO public.transactions (
    user_id,
    type,
    amount,
    status,
    description,
    idempotency_key
  ) VALUES (
    p_user_id,
    'withdraw',
    p_amount,
    'pending',
    COALESCE(p_description, 'Withdrawal of $' || p_amount),
    p_idempotency_key
  ) RETURNING id INTO transaction_id;
  
  -- Confirm transaction
  PERFORM public.confirm_transaction(transaction_id, p_user_id);
  
  RETURN transaction_id;
END;
$$;

-- Function to get transaction history with pagination
CREATE OR REPLACE FUNCTION public.get_transaction_history(
  p_user_id UUID,
  p_limit INTEGER DEFAULT 20,
  p_offset INTEGER DEFAULT 0,
  p_type TEXT DEFAULT NULL,
  p_status TEXT DEFAULT NULL
) RETURNS TABLE(
  id UUID,
  type TEXT,
  amount DECIMAL,
  status TEXT,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE,
  confirmed_at TIMESTAMP WITH TIME ZONE
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    t.id,
    t.type::text,
    t.amount,
    t.status::text,
    t.description,
    t.created_at,
    t.confirmed_at
  FROM public.transactions t
  WHERE t.user_id = p_user_id
    AND (p_type IS NULL OR t.type::text = p_type)
    AND (p_status IS NULL OR t.status::text = p_status)
  ORDER BY t.created_at DESC
  LIMIT p_limit OFFSET p_offset;
$$;

-- Function to check if user can afford amount
CREATE OR REPLACE FUNCTION public.can_user_afford(
  p_user_id UUID,
  p_amount DECIMAL
) RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT (balance - frozen_balance) >= p_amount
  FROM public.profiles
  WHERE user_id = p_user_id;
$$;
