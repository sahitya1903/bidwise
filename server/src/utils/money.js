// Money is stored as integer paise (₹1,100 → 110000) to avoid floating-point errors.

function rupeesToPaise(rupees) {
  return Math.round(Number(rupees) * 100);
}

function paiseToRupees(paise) {
  return paise / 100;
}

// 110000 → "₹1,100"; 109999 → "₹1,099.99"
function formatINR(paise) {
  const rupees = paise / 100;
  const hasFraction = paise % 100 !== 0;
  return (
    '₹' +
    rupees.toLocaleString('en-IN', {
      minimumFractionDigits: hasFraction ? 2 : 0,
      maximumFractionDigits: 2,
    })
  );
}

module.exports = { rupeesToPaise, paiseToRupees, formatINR };
