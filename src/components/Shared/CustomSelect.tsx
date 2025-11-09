import React from 'react';

interface CustomSelectProps {
  options: string[];
  value?: string;
  onChange: (v: string) => void;
  placeholder?: string;
  className?: string;
}

const CustomSelect: React.FC<CustomSelectProps> = ({ options, value = '', onChange, placeholder = 'Select', className = '' }) => {
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef<HTMLDivElement | null>(null);

  React.useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (!ref.current) return;
      if (!ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  return (
    <div ref={ref} className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="w-full text-left pl-10 pr-4 py-3 border border-gray-300 rounded-lg bg-white flex items-center justify-between focus:outline-none focus:ring-2 focus:ring-blue-500"
      >
        <span className={`truncate ${value ? 'text-gray-900' : 'text-gray-500'}`}>{value || placeholder}</span>
        <svg className="ml-2 h-4 w-4 text-gray-500" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
          <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 10.94l3.71-3.71a.75.75 0 111.06 1.06l-4.24 4.25a.75.75 0 01-1.06 0L5.21 8.29a.75.75 0 01.02-1.08z" clipRule="evenodd" />
        </svg>
      </button>

      {open && (
        <ul
          role="listbox"
          tabIndex={-1}
          className="absolute left-0 right-0 z-50 mt-1 max-h-56 overflow-y-auto bg-white border border-gray-200 rounded shadow-lg py-1"
        >
          {options.map(opt => (
            <li key={opt}>
              <button
                type="button"
                onClick={() => { onChange(opt); setOpen(false); }}
                className={`w-full text-left px-4 py-2 hover:bg-gray-100 ${value === opt ? 'bg-blue-600 text-white' : 'text-gray-900'}`}
              >
                {opt}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default CustomSelect;
