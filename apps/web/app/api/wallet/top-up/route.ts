import { NextResponse } from 'next/server';

/**
 * Legacy stub top-up — disabled. Wallet credits require Razorpay payment verification.
 * Use POST /api/payments/razorpay/create-order then /api/payments/razorpay/verify.
 */
export async function POST() {
  return NextResponse.json(
    {
      error:
        'Direct wallet top-up is disabled. Complete payment via Razorpay checkout first.',
    },
    {
      status: 400,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      },
    },
  );
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}
