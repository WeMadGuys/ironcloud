import { NextResponse } from 'next/server';

import { recordOtpSendFailure, toTenDigitPhone } from '@/lib/otp-send-failures';

/** Public endpoint. The customer app calls this after Send OTP already failed. */
export async function POST(req: Request) {
  let body: { phone?: unknown; message?: unknown };
  try {
    body = JSON.parse(await req.text()) as typeof body;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }

  const phone = toTenDigitPhone(body.phone);
  const message = typeof body.message === 'string' ? body.message.trim() : '';
  if (!phone || !message) {
    return NextResponse.json({ error: 'Invalid failure report.' }, { status: 400 });
  }

  await recordOtpSendFailure({ phone, message });
  return new NextResponse(null, { status: 204 });
}
