// Amounts are integer paise, so sums stay exact. Never divide them into
// fractional rupees; split them with integer division instead.

export function sumPaise(amounts: number[]) {
  return amounts.reduce((total, amount) => total + amount, 0);
}

export function formatPaise(paise: number) {
  const sign = paise < 0 ? "-" : "";
  const absolute = Math.abs(paise);
  const rupees = Math.trunc(absolute / 100);
  const remainder = absolute % 100;
  return `${sign}${rupees.toLocaleString("en-IN")}.${String(remainder).padStart(2, "0")}`;
}

const ONES = [
  "",
  "One",
  "Two",
  "Three",
  "Four",
  "Five",
  "Six",
  "Seven",
  "Eight",
  "Nine",
  "Ten",
  "Eleven",
  "Twelve",
  "Thirteen",
  "Fourteen",
  "Fifteen",
  "Sixteen",
  "Seventeen",
  "Eighteen",
  "Nineteen",
];
const TENS = [
  "",
  "",
  "Twenty",
  "Thirty",
  "Forty",
  "Fifty",
  "Sixty",
  "Seventy",
  "Eighty",
  "Ninety",
];

function belowHundred(number: number) {
  if (number < 20) return ONES[number];
  const tens = TENS[Math.trunc(number / 10)];
  return number % 10 ? `${tens}-${ONES[number % 10]}` : tens;
}

function belowThousand(number: number) {
  const hundreds = Math.trunc(number / 100);
  const rest = number % 100;
  return [hundreds ? `${ONES[hundreds]} Hundred` : "", belowHundred(rest)]
    .filter(Boolean)
    .join(" ");
}

// Indian numbering: crore, lakh, thousand, hundred.
function integerInWords(number: number): string {
  if (number === 0) return "Zero";

  const crore = Math.trunc(number / 10_000_000);
  const lakh = Math.trunc((number % 10_000_000) / 100_000);
  const thousand = Math.trunc((number % 100_000) / 1000);
  const rest = number % 1000;

  return [
    crore ? `${integerInWords(crore)} Crore` : "",
    lakh ? `${belowHundred(lakh)} Lakh` : "",
    thousand ? `${belowHundred(thousand)} Thousand` : "",
    rest ? belowThousand(rest) : "",
  ]
    .filter(Boolean)
    .join(" ");
}

export function rupeesInWords(paise: number) {
  const absolute = Math.abs(paise);
  const rupees = integerInWords(Math.trunc(absolute / 100));
  const remainder = absolute % 100;
  const words = remainder
    ? `Rupees ${rupees} and ${belowHundred(remainder)} Paise Only`
    : `Rupees ${rupees} Only`;
  return paise < 0 ? `Minus ${words}` : words;
}
