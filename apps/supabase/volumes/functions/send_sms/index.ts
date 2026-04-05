Deno.serve(async (req: Request) => {
  const payload = await req.json()
  const phone: string = payload?.user?.phone ?? 'unknown'
  const otp: string = payload?.sms?.otp ?? 'unknown'

  // TODO: Replace with MSG91 integration
  console.log(`[OTP] Phone: ${phone} | OTP: ${otp}`)

  return new Response(JSON.stringify({}), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
})
