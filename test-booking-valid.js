async function testBookingInvalid() {
  try {
    const res = await fetch('http://localhost:3000/customer-service', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        // Missing fields to trigger class-validator
      })
    });
    const data = await res.json();
    console.log("Error Payload:", data);
  } catch (err) {
    console.error("Fetch failed:", err);
  }
}
testBookingInvalid();
