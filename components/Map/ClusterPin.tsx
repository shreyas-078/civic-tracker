interface Props {
    count: number;
    dimmed?: boolean;
}

export function ClusterPin({ count, dimmed }: Props) {
    const size = count < 10 ? 36 : count < 50 ? 44 : count < 200 ? 52 : 60;
    const fontSize = count >= 1000 ? 9 : count >= 100 ? 10 : 13;
    const opacity = dimmed ? 0.35 : 1;
    const label =
        count >= 10000 ? `${Math.round(count / 1000)}k` : String(count);

    return (
        <div
            className="rounded-full flex items-center justify-center font-semibold text-white shadow-lg cursor-pointer hover:scale-105 transition-transform border-2 border-white"
            style={{
                width: size,
                height: size,
                backgroundColor: "#2563eb",
                fontSize,
                opacity,
            }}
        >
            {label}
        </div>
    );
}
