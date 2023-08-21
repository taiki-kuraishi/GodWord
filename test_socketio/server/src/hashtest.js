import CRC32 from 'crc-32';

function calculateCRC32(inputString) {
  const crcValue = CRC32.str(inputString);
  return crcValue.toString(36).toLowerCase();
}

const inputString = "0";
var crc32Hash = calculateCRC32(inputString);

console.log(`CRC32 Hash: ${crc32Hash}`);

if (crc32Hash[0] == '-') {
    crc32Hash = crc32Hash.slice(1);
}

console.log(`Input: ${inputString}`);
console.log(`CRC32 Hash: ${crc32Hash}`);
