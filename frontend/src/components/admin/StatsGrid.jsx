import StatCard from "./StatCard";

function StatsGrid({ stats }) {
    return (
        <div className="stats-grid department-stats">
            {stats.map((item) => (
                <StatCard
                    key={item.label}
                    label={item.label}
                    value={item.value}
                />
            ))}
        </div>
    );
}

export default StatsGrid;
