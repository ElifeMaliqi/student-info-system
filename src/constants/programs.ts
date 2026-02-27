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
  { id: 'PRG-001', name: 'Web Development', price: '$3,200', duration: '8', teachers: 4, students: 62, status: 'Active' },
  { id: 'PRG-002', name: 'Digital Marketing with AI', price: '$2,800', duration: '6', teachers: 3, students: 35, status: 'Active' },
  { id: 'PRG-003', name: 'UI/UX Creative Designer', price: '$2,500', duration: '6', teachers: 3, students: 45, status: 'Active' },
  { id: 'PRG-004', name: 'Internet of Things (UAV/IoT)', price: '$3,500', duration: '9', teachers: 2, students: 22, status: 'Active' },
  { id: 'PRG-005', name: 'UAV Engineering Degree', price: '$4,200', duration: '12', teachers: 2, students: 15, status: 'Active' },
  { id: 'PRG-006', name: 'Cybersecurity', price: '$4,000', duration: '12', teachers: 2, students: 28, status: 'Active' },
  { id: 'PRG-007', name: '3D Creative Artist', price: '$2,900', duration: '7', teachers: 3, students: 31, status: 'Active' },
  { id: 'PRG-008', name: 'Entrepreneurship', price: '$2,400', duration: '5', teachers: 2, students: 38, status: 'Active' },
];
