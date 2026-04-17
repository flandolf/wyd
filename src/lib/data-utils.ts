import { SubjectData } from "../components/SubjectItem";

function escapeCsvCell(cell: any): string {
  let str = String(cell ?? '');
  // Neutralize formula injection
  if (['=', '+', '-', '@'].includes(str[0])) {
    str = "'" + str;
  }
  // Escape quotes and wrap
  return '"' + str.replace(/"/g, '""') + '"';
}

export function exportToJSON(subjects: SubjectData[]) {
  const dataStr = JSON.stringify(subjects, null, 2);
  const blob = new Blob([dataStr], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);

  const filename = `focusflow-export-${new Date().toISOString().split('T')[0]}.json`;
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function exportToCSV(subjects: SubjectData[]) {
  const headers = ["Subject", "Category", "Date", "Duration (ms)", "Notes"];
  let csvContent = headers.join(",") + "\n";

  subjects.forEach(subject => {
    subject.sessions?.forEach(session => {
      const row = [
        escapeCsvCell(subject.title),
        escapeCsvCell(subject.category || ''),
        escapeCsvCell(session.date),
        escapeCsvCell(session.durationMs),
        escapeCsvCell(session.notes || '')
      ].join(",");
      csvContent += row + "\n";
    });
  });

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);

  const filename = `focusflow-export-${new Date().toISOString().split('T')[0]}.csv`;
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
