import { useTheme } from "../context/ThemeContext";

const OPTIONS = [
  { value: "light", label: "Light theme", icon: "bi-sun-fill" },
  { value: "system", label: "Match system theme", icon: "bi-circle-half" },
  { value: "dark", label: "Dark theme", icon: "bi-moon-stars-fill" },
];

export default function ThemeToggle({ className = "" }) {
  const { preference, setPreference } = useTheme();

  return (
    <div className={`sg-theme-switch ${className}`} role="radiogroup" aria-label="Color theme">
      {OPTIONS.map((option) => (
        <button
          key={option.value}
          type="button"
          role="radio"
          aria-checked={preference === option.value}
          aria-label={option.label}
          title={option.label}
          className={preference === option.value ? "is-active" : ""}
          onClick={() => setPreference(option.value)}
        >
          <i className={`bi ${option.icon}`}></i>
        </button>
      ))}
    </div>
  );
}
