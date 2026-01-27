import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const MAPBOX_TOKEN = Deno.env.get('MAPBOX_ACCESS_TOKEN') || 'pk.eyJ1Ijoic3VyZW5hbWVzIiwiYSI6ImNta3UxenZjajF2aDUzY3NhZXNqY3JjeXkifQ.lBzScNO-wcVp0gFnExQx-w';

serve(async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { action, origin, destination, waypoints, profile = 'driving', language = 'ru' } = await req.json();

    // ACTION: Get directions
    if (action === 'directions') {
      if (!origin || !destination) {
        return new Response(
          JSON.stringify({ success: false, error: 'Origin and destination required' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
        );
      }

      // Build coordinates string
      let coordinates = `${origin.lng},${origin.lat};`;
      
      if (waypoints && waypoints.length > 0) {
        coordinates += waypoints.map((wp: { lat: number; lng: number }) => `${wp.lng},${wp.lat}`).join(';') + ';';
      }
      
      coordinates += `${destination.lng},${destination.lat}`;

      const url = `https://api.mapbox.com/directions/v5/mapbox/${profile}/${coordinates}?geometries=geojson&overview=full&steps=true&voice_instructions=true&banner_instructions=true&language=${language}&access_token=${MAPBOX_TOKEN}`;

      const response = await fetch(url);
      const data = await response.json();

      if (!response.ok || !data.routes || data.routes.length === 0) {
        return new Response(
          JSON.stringify({ success: false, error: 'No route found', details: data }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 404 }
        );
      }

      const route = data.routes[0];
      
      return new Response(
        JSON.stringify({
          success: true,
          route: {
            distance: route.distance,
            duration: route.duration,
            geometry: route.geometry,
            legs: route.legs.map((leg: any) => ({
              distance: leg.distance,
              duration: leg.duration,
              summary: leg.summary,
              steps: leg.steps.map((step: any) => ({
                distance: step.distance,
                duration: step.duration,
                instruction: step.maneuver.instruction,
                type: step.maneuver.type,
                modifier: step.maneuver.modifier,
                location: step.maneuver.location,
                name: step.name,
                voiceInstruction: step.voiceInstructions?.[0]?.announcement,
                bannerInstruction: step.bannerInstructions?.[0]?.primary?.text,
              })),
            })),
          },
          alternatives: data.routes.slice(1).map((r: any) => ({
            distance: r.distance,
            duration: r.duration,
            geometry: r.geometry,
          })),
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ACTION: Geocode address
    if (action === 'geocode') {
      const { query, types = 'address,poi,place', limit = 5, bbox } = await req.json();

      if (!query) {
        return new Response(
          JSON.stringify({ success: false, error: 'Query required' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
        );
      }

      let url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json?access_token=${MAPBOX_TOKEN}&language=${language}&types=${types}&limit=${limit}`;
      
      if (bbox) {
        url += `&bbox=${bbox}`;
      }

      const response = await fetch(url);
      const data = await response.json();

      return new Response(
        JSON.stringify({
          success: true,
          results: data.features?.map((f: any) => ({
            id: f.id,
            name: f.text,
            fullAddress: f.place_name,
            coordinates: { lng: f.center[0], lat: f.center[1] },
            type: f.place_type?.[0],
            context: f.context,
          })) || [],
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ACTION: Reverse geocode
    if (action === 'reverse-geocode') {
      const { lat, lng, types = 'address' } = await req.json();

      if (!lat || !lng) {
        return new Response(
          JSON.stringify({ success: false, error: 'Coordinates required' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
        );
      }

      const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${lng},${lat}.json?access_token=${MAPBOX_TOKEN}&language=${language}&types=${types}&limit=1`;

      const response = await fetch(url);
      const data = await response.json();

      const result = data.features?.[0];
      
      return new Response(
        JSON.stringify({
          success: true,
          result: result ? {
            address: result.place_name,
            name: result.text,
            coordinates: { lng: result.center[0], lat: result.center[1] },
          } : null,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ACTION: Get isochrone (travel time areas)
    if (action === 'isochrone') {
      const { lat, lng, minutes = [5, 10, 15], profile = 'driving' } = await req.json();

      if (!lat || !lng) {
        return new Response(
          JSON.stringify({ success: false, error: 'Coordinates required' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
        );
      }

      const url = `https://api.mapbox.com/isochrone/v1/mapbox/${profile}/${lng},${lat}?contours_minutes=${minutes.join(',')}&polygons=true&access_token=${MAPBOX_TOKEN}`;

      const response = await fetch(url);
      const data = await response.json();

      return new Response(
        JSON.stringify({
          success: true,
          isochrones: data.features,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ success: false, error: 'Invalid action' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    );

  } catch (error: unknown) {
    console.error('Mapbox API error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    return new Response(
      JSON.stringify({ success: false, error: 'Internal server error', message: errorMessage }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
