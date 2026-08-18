import type { Member } from "../lib/reports";

interface Props {
  members: Member[];
  selected: string;
  onSelect: (id: string) => void;
}

export function MemberSelector({ members, selected, onSelect }: Props) {
  return (
    <select
      value={selected}
      onChange={(e) => onSelect(e.target.value)}
      className="rounded-lg border border-line bg-card px-4 py-2 text-sm text-ink outline-none focus:ring-2 focus:ring-navy"
    >
      <option value="">Todos os integrantes</option>
      {members.map((member) => (
        <option key={member.id} value={member.id}>
          {member.name}
        </option>
      ))}
    </select>
  );
}
