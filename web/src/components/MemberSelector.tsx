import type { Member } from "../lib/reports";

interface Props {
  members: Member[];
  selected: string;
  onSelect: (id: string) => void;
}

export function MemberSelector({ members, selected, onSelect }: Props) {
  return (
    <div className="relative">
      <select
        value={selected}
        onChange={(e) => onSelect(e.target.value)}
        className="appearance-none rounded-xl border border-line bg-card py-2 pl-3.5 pr-8 text-sm font-medium text-ink shadow-2xs outline-none transition hover:border-navy/30 focus:border-navy focus:ring-2 focus:ring-navy/20 cursor-pointer"
      >
        <option value="">👥 Todos os integrantes</option>
        {members.map((member) => (
          <option key={member.id} value={member.id}>
            {member.name}
          </option>
        ))}
      </select>
      <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2.5 text-muted">
        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </div>
    </div>
  );
}
