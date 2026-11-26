export const skillAliases = {
  "Figma": ["ui ux", "ui design", "desain ui", "prototipe ui"],
  "Ilustrasi Digital": ["digital illustration", "gambar digital"],
  "Animasi 2D": ["2d animation", "animasi dua dimensi"],
  "Editing Video": ["video editing", "penyuntingan video", "capcut", "premiere pro"],
  "Fotografi": ["photography", "foto produk"],
  "Desain Grafis": ["graphic design", "canva", "desain poster"],
  "Copywriting": ["copy writer", "sales copy", "naskah iklan"],
  "Pemasaran Digital": ["digital marketing", "pemasaran online", "seo"],
  "Bahasa Inggris": ["english", "percakapan inggris", "english conversation"],
  "Public Speaking": ["presentasi", "berbicara di depan umum"],
  "Penulisan Akademik": ["academic writing", "artikel ilmiah", "penulisan ilmiah"],
  "Metode Riset": ["metodologi riset", "metodologi penelitian", "research methods"],
  "Statistika": ["statistik", "statistics", "uji hipotesis"],
  "Analisis Data": ["data analysis", "visualisasi data"],
  "Excel": ["spreadsheet", "pivot table", "google sheets"],
  "SQL": ["query sql", "postgresql", "mysql"],
  "Python": ["pandas", "jupyter"],
  "Machine Learning": ["pembelajaran mesin", "scikit learn"],
  "Git": ["git dasar", "github", "version control"],
  "JavaScript": ["java script", "js", "vanilla js"],
  "React": ["react js", "reactjs", "next js", "nextjs"],
  "HTML dan CSS": ["html css", "html", "css"],
  "UI Research": ["user research", "ux research", "riset pengguna"],
  "Manajemen Proyek": ["project management", "scrum", "kanban"],
  "Analisis Bisnis": ["business analysis", "analisis proses bisnis"],
} as const;

const skillLabels = new Map([
  ["Ilustrasi Digital", "Digital Illustration"],
  ["Animasi 2D", "2D Animation"],
  ["Editing Video", "Video Editing"],
  ["Fotografi", "Photography"],
  ["Desain Grafis", "Graphic Design"],
  ["Pemasaran Digital", "Digital Marketing"],
  ["Bahasa Inggris", "English"],
  ["Penulisan Akademik", "Academic Writing"],
  ["Metode Riset", "Research Methods"],
  ["Statistika", "Statistics"],
  ["Analisis Data", "Data Analysis"],
  ["HTML dan CSS", "HTML and CSS"],
  ["Manajemen Proyek", "Project Management"],
  ["Analisis Bisnis", "Business Analysis"],
]);

export function skillLabel(skill: string) {
  return skillLabels.get(skill) ?? skill;
}

export const skillSuggestions = Object.keys(skillAliases).map(skillLabel).sort();
