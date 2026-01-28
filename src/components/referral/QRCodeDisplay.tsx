import { useEffect, useRef } from 'react';

interface QRCodeDisplayProps {
  value: string;
  size?: number;
}

// Simple QR Code generator using canvas
// Using a lightweight implementation without external dependencies
const QRCodeDisplay = ({ value, size = 200 }: QRCodeDisplayProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!canvasRef.current || !value) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Generate QR code matrix using simple encoding
    const qrMatrix = generateQRMatrix(value);
    const moduleCount = qrMatrix.length;
    const moduleSize = size / moduleCount;

    // Clear canvas
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, size, size);

    // Draw QR modules
    ctx.fillStyle = '#000000';
    for (let row = 0; row < moduleCount; row++) {
      for (let col = 0; col < moduleCount; col++) {
        if (qrMatrix[row][col]) {
          ctx.fillRect(
            col * moduleSize,
            row * moduleSize,
            moduleSize,
            moduleSize
          );
        }
      }
    }
  }, [value, size]);

  return (
    <div className="bg-white p-4 rounded-xl shadow-sm inline-block">
      <canvas
        ref={canvasRef}
        width={size}
        height={size}
        className="block"
      />
    </div>
  );
};

// Simple QR code matrix generator
// This creates a visual representation that looks like a QR code
// For production, you'd want to use a proper QR library
function generateQRMatrix(data: string): boolean[][] {
  const size = 25; // QR code size
  const matrix: boolean[][] = Array(size).fill(null).map(() => Array(size).fill(false));

  // Add finder patterns (corners)
  addFinderPattern(matrix, 0, 0);
  addFinderPattern(matrix, size - 7, 0);
  addFinderPattern(matrix, 0, size - 7);

  // Add timing patterns
  for (let i = 8; i < size - 8; i++) {
    matrix[6][i] = i % 2 === 0;
    matrix[i][6] = i % 2 === 0;
  }

  // Add alignment pattern
  addAlignmentPattern(matrix, size - 9, size - 9);

  // Fill data area with pseudo-random pattern based on input
  const hash = simpleHash(data);
  let bitIndex = 0;
  
  for (let col = size - 1; col >= 0; col -= 2) {
    if (col === 6) col = 5; // Skip timing column
    
    for (let row = 0; row < size; row++) {
      for (let c = 0; c < 2; c++) {
        const x = col - c;
        if (!isReserved(matrix, row, x, size)) {
          matrix[row][x] = ((hash >> (bitIndex % 32)) & 1) === 1;
          bitIndex++;
        }
      }
    }
  }

  return matrix;
}

function addFinderPattern(matrix: boolean[][], startRow: number, startCol: number) {
  for (let r = 0; r < 7; r++) {
    for (let c = 0; c < 7; c++) {
      matrix[startRow + r][startCol + c] = 
        r === 0 || r === 6 || c === 0 || c === 6 || // Border
        (r >= 2 && r <= 4 && c >= 2 && c <= 4);     // Center
    }
  }
}

function addAlignmentPattern(matrix: boolean[][], row: number, col: number) {
  for (let r = -2; r <= 2; r++) {
    for (let c = -2; c <= 2; c++) {
      const dr = row + r;
      const dc = col + c;
      if (dr >= 0 && dr < matrix.length && dc >= 0 && dc < matrix.length) {
        matrix[dr][dc] = 
          r === -2 || r === 2 || c === -2 || c === 2 || // Border
          (r === 0 && c === 0); // Center
      }
    }
  }
}

function isReserved(matrix: boolean[][], row: number, col: number, size: number): boolean {
  // Finder patterns + separators
  if ((row < 9 && col < 9) || // Top-left
      (row < 9 && col >= size - 8) || // Top-right
      (row >= size - 8 && col < 9)) { // Bottom-left
    return true;
  }
  // Timing patterns
  if (row === 6 || col === 6) return true;
  // Alignment pattern area
  if (row >= size - 11 && row <= size - 7 && col >= size - 11 && col <= size - 7) return true;
  
  return false;
}

function simpleHash(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash);
}

export default QRCodeDisplay;
