export const PROGRAMS = [
  'Web Development',
  'Digital Marketing with AI',
  'UI/UX Creative Designer',
  'Internet of Things (UAV/IoT)',
  'UAV Engineering Degree',
  'Cybersecurity',
  '3D Creative Artist',
  'Entrepreneurship'
] as const;

export type Program = typeof PROGRAMS[number];

export const PROGRAM_DETAILS = [
  { id: 'PRG-001', name: 'Web Development', price: '€60/mo', duration: '8', teachers: 4, students: 62, status: 'Active' },
  { id: 'PRG-002', name: 'Digital Marketing with AI', price: '€60/mo', duration: '6', teachers: 3, students: 35, status: 'Active' },
  { id: 'PRG-003', name: 'UI/UX Creative Designer', price: '€60/mo', duration: '6', teachers: 3, students: 45, status: 'Active' },
  { id: 'PRG-004', name: 'Internet of Things (UAV/IoT)', price: '€60/mo', duration: '9', teachers: 2, students: 22, status: 'Active' },
  { id: 'PRG-005', name: 'UAV Engineering Degree', price: '€60/mo', duration: '12', teachers: 2, students: 15, status: 'Active' },
  { id: 'PRG-006', name: 'Cybersecurity', price: '€60/mo', duration: '12', teachers: 2, students: 28, status: 'Active' },
  { id: 'PRG-007', name: '3D Creative Artist', price: '€60/mo', duration: '7', teachers: 3, students: 31, status: 'Active' },
  { id: 'PRG-008', name: 'Entrepreneurship', price: '€60/mo', duration: '5', teachers: 2, students: 38, status: 'Active' },
];
