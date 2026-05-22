import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET() {
  const { data } = await supabase
    .from('connectio_stats')
    .select('*')
    .single();

  const dailyPlayed  = Number(data?.daily_played  ?? 0);
  const customPlayed = Number(data?.custom_played ?? 0);
  const customMade   = Number(data?.custom_made   ?? 0);
  const totalPlayed  = dailyPlayed + customPlayed;

  const svg = `
<svg width="420" height="160" xmlns="http://www.w3.org/2000/svg">
  <rect width="420" height="160" rx="10" fill="#161b22" stroke="#30363d" stroke-width="1"/>

  <!-- Header -->
  <text x="20" y="32" fill="#f0f6fc" font-size="15" font-weight="bold" font-family="monospace">Connectio</text>
  <text x="108" y="32" fill="#8b949e" font-size="15" font-family="monospace">— live stats</text>
  <line x1="20" y1="42" x2="400" y2="42" stroke="#30363d" stroke-width="1"/>

  <!-- Stat: Daily Played -->
  <text x="30" y="80" fill="#8b949e" font-size="11" font-family="monospace">DAILY PLAYED</text>
  <text x="30" y="105" fill="#58a6ff" font-size="26" font-weight="bold" font-family="monospace">${dailyPlayed}</text>

  <!-- Divider -->
  <line x1="160" y1="55" x2="160" y2="125" stroke="#30363d" stroke-width="1"/>

  <!-- Stat: Custom Played -->
  <text x="175" y="80" fill="#8b949e" font-size="11" font-family="monospace">CUSTOM PLAYED</text>
  <text x="175" y="105" fill="#3fb950" font-size="26" font-weight="bold" font-family="monospace">${customPlayed}</text>

  <!-- Divider -->
  <line x1="305" y1="55" x2="305" y2="125" stroke="#30363d" stroke-width="1"/>

  <!-- Stat: Custom Made -->
  <text x="320" y="80" fill="#8b949e" font-size="11" font-family="monospace">CUSTOM MADE</text>
  <text x="320" y="105" fill="#d2a8ff" font-size="26" font-weight="bold" font-family="monospace">${customMade}</text>

  <!-- Footer -->
  <line x1="20" y1="128" x2="400" y2="128" stroke="#30363d" stroke-width="1"/>
  <text x="20" y="147" fill="#8b949e" font-size="10" font-family="monospace">${totalPlayed} total plays across all puzzles</text>
  <text x="400" y="147" fill="#8b949e" font-size="10" font-family="monospace" text-anchor="end">connections.wyattprice.dev</text>
</svg>`;

  return new NextResponse(svg, {
    headers: {
      'Content-Type': 'image/svg+xml',
      'Cache-Control': 's-maxage=3600, stale-while-revalidate',
    },
  });
}