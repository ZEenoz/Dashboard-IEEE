export default function StatCard({ title, value, unit, icon: Icon, color = "blue" }) {
    const colorClasses = {
        blue: "text-blue-500 bg-blue-500/10",
        green: "text-green-500 bg-green-500/10",
        purple: "text-purple-500 bg-purple-500/10",
        red: "text-red-500 bg-red-500/10",
    };

    return (
        <div className="bg-[#1F2937] p-6 rounded-2xl border border-gray-800 hover:border-gray-700 transition-all cursor-pointer group">
            <div className="flex justify-between items-start">
                <div>
                    <h3 className="text-gray-400 text-sm font-medium mb-1">{title}</h3>
                    <div className="flex items-baseline gap-1">
                        <span className="text-2xl font-bold text-white">{value}</span>
                        {unit && <span className="text-sm text-gray-500 font-medium">{unit}</span>}
                    </div>
                </div>
                <div className={`p-3 rounded-lg ${colorClasses[color]} group-hover:scale-110 transition-transform`}>
                    <Icon className="w-6 h-6" />
                </div>
            </div>
        </div>
    );
}
