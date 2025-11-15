import { UnitDto } from "@/shared/unit";
import Image from "next/image";

interface UnitCardProps {
    unit: UnitDto;
}

export default function UnitCard({ unit }: UnitCardProps) {
    const iconPath = `/units/${unit.id}.png`;

    const stats = [
        { label: "HP", value: unit.maxHp },
        { label: "Melee", value: unit.meleeAttack },
        { label: "Ranged", value: unit.rangedAttack },
        { label: "Range", value: unit.attackRange },
        { label: "Defense", value: unit.defense },
        { label: "Speed", value: unit.speed },
        { label: "Cost", value: unit.cost },
        ];

    return <div className="rounded-2xl border border-slate-700 bg-slate-800/60 p-4 flex flex-col gap-3">
        <Image
            src={iconPath}
            alt={unit.name}
            width={48}
            height={48}
            className=" border border-slate-700 bg-slate-900"
            />
        <h2 className="text-xl font-semibold mb-2">{unit.name}</h2>
        <dl className="grid grid-cols-2 gap-2 text-sm text-slate-300">
        {stats.map((stat) => (
            <div key={stat.label} className="flex justify-between">
            <dt className="text-slate-400">{stat.label}</dt>
            <dd className="font-medium">{stat.value}</dd>
            </div>
        ))}
        </dl>

    </div>
};
