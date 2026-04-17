import { SubjectData } from "../components/SubjectItem";

export function exportToJSON(subjects: SubjectData[]) {
  const dataStr = JSON.stringify(subjects, null, 2);
  const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);

  const exportFileDefaultName = `focusflow-export-${new Date().toISOString().split('T')[0]}.json`;

  const linkElement = document.createElement('a');
  linkElement.setAttribute('href', dataUri);
  linkElement.setAttribute('download', exportFileDefaultName);
  linkElement.click();
}

export function exportToCSV(subjects: SubjectData[]) {
  let csvContent = "Subject,Category,Date,Duration (ms),Notes\n";

  subjects.forEach(subject => {
    subject.sessions?.forEach(session => {
      const row = [
        `"${subject.title}"`,
        `"${subject.category || ''}"`,
        session.date,
        session.durationMs,
        `"${session.notes || ''}"`
      ].join(",");
      csvContent += row + "\n";
    });
  });

  const dataUri = 'data:text/csv;charset=utf-8,' + encodeURIComponent(csvContent);
  const exportFileDefaultName = `focusflow-export-${new Date().toISOString().split('T')[0]}.csv`;

  const linkElement = document.createElement('a');
  linkElement.setAttribute('href', dataUri);
  linkElement.setAttribute('download', exportFileDefaultName);
  linkElement.click();
}
