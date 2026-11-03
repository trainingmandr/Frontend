export function downloadFile(fileName: string, contents: string, type: string) {
  const blob = new Blob([contents], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
}

// The BOM makes Excel open the ₹ and other characters as UTF-8.
export function downloadCsv(fileName: string, csv: string) {
  downloadFile(fileName, `﻿${csv}`, "text/csv;charset=utf-8");
}
