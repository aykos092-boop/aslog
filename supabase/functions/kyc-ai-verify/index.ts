import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY')!;

interface OCRResult {
  firstName?: string;
  lastName?: string;
  middleName?: string;
  dateOfBirth?: string;
  passportNumber?: string;
  passportSeries?: string;
  country?: string;
  expiryDate?: string;
  confidence: number;
  rawText?: string;
}

interface VerificationResult {
  ocrData: OCRResult;
  dataMatchScore: number;
  fraudScore: number;
  riskLevel: 'low' | 'medium' | 'high';
  autoVerified: boolean;
  issues: string[];
}

// Use Lovable AI (Gemini) for OCR
async function extractPassportDataWithAI(imageUrl: string): Promise<OCRResult> {
  console.log('Extracting passport data from:', imageUrl);

  try {
    const response = await fetch('https://api.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          {
            role: 'system',
            content: `You are an expert document OCR system. Extract passport/ID data from images with high accuracy.
            
            Return ONLY a JSON object with these fields:
            {
              "firstName": "extracted first name",
              "lastName": "extracted last name", 
              "middleName": "extracted middle name if present",
              "dateOfBirth": "YYYY-MM-DD format",
              "passportNumber": "document number",
              "passportSeries": "series if present",
              "country": "issuing country",
              "expiryDate": "YYYY-MM-DD format",
              "confidence": 0.0-1.0 confidence score,
              "rawText": "all visible text"
            }
            
            If a field cannot be read, set it to null. Be very accurate.`
          },
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: 'Extract all passport/ID data from this document image. Return only the JSON object.'
              },
              {
                type: 'image_url',
                image_url: { url: imageUrl }
              }
            ]
          }
        ],
        max_tokens: 1000,
        temperature: 0.1,
      }),
    });

    if (!response.ok) {
      throw new Error(`AI API error: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices[0]?.message?.content || '';
    
    // Parse JSON from response
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return {
        ...parsed,
        confidence: parsed.confidence || 0.7,
      };
    }

    return { confidence: 0 };
  } catch (error) {
    console.error('OCR extraction error:', error);
    return { confidence: 0 };
  }
}

// Compare extracted data with user input
function compareData(ocr: OCRResult, userInput: any): { score: number; issues: string[] } {
  const issues: string[] = [];
  let matchedFields = 0;
  let totalFields = 0;

  const normalize = (s?: string) => (s || '').toLowerCase().trim().replace(/\s+/g, ' ');

  // Compare first name
  if (userInput.firstName && ocr.firstName) {
    totalFields++;
    if (normalize(ocr.firstName).includes(normalize(userInput.firstName)) ||
        normalize(userInput.firstName).includes(normalize(ocr.firstName))) {
      matchedFields++;
    } else {
      issues.push(`First name mismatch: expected "${userInput.firstName}", OCR found "${ocr.firstName}"`);
    }
  }

  // Compare last name
  if (userInput.lastName && ocr.lastName) {
    totalFields++;
    if (normalize(ocr.lastName).includes(normalize(userInput.lastName)) ||
        normalize(userInput.lastName).includes(normalize(ocr.lastName))) {
      matchedFields++;
    } else {
      issues.push(`Last name mismatch: expected "${userInput.lastName}", OCR found "${ocr.lastName}"`);
    }
  }

  // Compare date of birth
  if (userInput.dateOfBirth && ocr.dateOfBirth) {
    totalFields++;
    if (normalize(ocr.dateOfBirth) === normalize(userInput.dateOfBirth)) {
      matchedFields++;
    } else {
      issues.push(`Date of birth mismatch: expected "${userInput.dateOfBirth}", OCR found "${ocr.dateOfBirth}"`);
    }
  }

  // Compare passport number
  if (userInput.passportNumber && ocr.passportNumber) {
    totalFields++;
    const userPassport = normalize(userInput.passportNumber).replace(/\s/g, '');
    const ocrPassport = normalize(ocr.passportNumber).replace(/\s/g, '');
    if (userPassport === ocrPassport || userPassport.includes(ocrPassport) || ocrPassport.includes(userPassport)) {
      matchedFields++;
    } else {
      issues.push(`Passport number mismatch: expected "${userInput.passportNumber}", OCR found "${ocr.passportNumber}"`);
    }
  }

  const score = totalFields > 0 ? matchedFields / totalFields : 0;
  return { score, issues };
}

// Calculate fraud score
function calculateFraudScore(ocr: OCRResult, comparison: { score: number; issues: string[] }): number {
  let fraudScore = 0;

  // Low OCR confidence is suspicious
  if (ocr.confidence < 0.5) fraudScore += 30;
  else if (ocr.confidence < 0.7) fraudScore += 15;

  // Data mismatches increase fraud score
  fraudScore += comparison.issues.length * 15;

  // Low match score is suspicious
  if (comparison.score < 0.5) fraudScore += 25;
  else if (comparison.score < 0.75) fraudScore += 10;

  return Math.min(100, fraudScore);
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { kycDocumentId, passportImageUrl, userInput } = await req.json();

    if (!kycDocumentId || !passportImageUrl) {
      return new Response(
        JSON.stringify({ success: false, error: 'Missing required parameters' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    console.log(`Processing KYC verification for document: ${kycDocumentId}`);

    // Extract data with AI OCR
    const ocrData = await extractPassportDataWithAI(passportImageUrl);
    console.log('OCR extraction result:', ocrData);

    // Compare with user input
    const comparison = compareData(ocrData, userInput || {});
    console.log('Data comparison:', comparison);

    // Calculate fraud score
    const fraudScore = calculateFraudScore(ocrData, comparison);
    
    // Determine risk level
    let riskLevel: 'low' | 'medium' | 'high';
    if (fraudScore < 20) riskLevel = 'low';
    else if (fraudScore < 50) riskLevel = 'medium';
    else riskLevel = 'high';

    // Auto-verify if low risk and high match
    const autoVerified = riskLevel === 'low' && comparison.score >= 0.85 && ocrData.confidence >= 0.8;

    const result: VerificationResult = {
      ocrData,
      dataMatchScore: comparison.score,
      fraudScore,
      riskLevel,
      autoVerified,
      issues: comparison.issues,
    };

    // Update KYC document with results
    const updateData: any = {
      ocr_extracted_name: ocrData.firstName,
      ocr_extracted_surname: ocrData.lastName,
      ocr_extracted_dob: ocrData.dateOfBirth,
      ocr_extracted_passport_number: ocrData.passportNumber,
      ocr_extracted_country: ocrData.country,
      ocr_extracted_expiry: ocrData.expiryDate,
      ocr_confidence: ocrData.confidence,
      ocr_raw_data: ocrData,
      data_match_score: comparison.score,
      fraud_score: fraudScore,
      risk_level: riskLevel,
      auto_verified: autoVerified,
      updated_at: new Date().toISOString(),
    };

    // If auto-verified, update status
    if (autoVerified) {
      updateData.status = 'verified';
    } else if (riskLevel === 'high') {
      updateData.status = 'manual_review';
    }

    const { error: updateError } = await supabase
      .from('kyc_documents')
      .update(updateData)
      .eq('id', kycDocumentId);

    if (updateError) {
      console.error('Error updating KYC document:', updateError);
    }

    // Log security event
    await supabase.from('security_events').insert({
      event_type: 'kyc_ai_verification',
      severity: riskLevel === 'high' ? 'warning' : 'info',
      description: `KYC AI verification completed. Risk: ${riskLevel}, Fraud score: ${fraudScore}`,
      metadata: { kycDocumentId, result }
    });

    return new Response(
      JSON.stringify({ success: true, result }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('KYC verification error:', error);
    return new Response(
      JSON.stringify({ success: false, error: 'Verification failed' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});