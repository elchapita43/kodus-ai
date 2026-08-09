"use client";

import { BrainCircuit, CheckCircle2, Layers, Sparkles } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@components/ui/card";
import { useLearningStats } from "@services/learnings/hooks";

export function LearningsStats() {
    const { data: stats, isLoading } = useLearningStats();

    const cards = [
        {
            label: "Total",
            value: stats?.total ?? 0,
            icon: <Layers className="size-4" />,
        },
        {
            label: "Activos",
            value: stats?.active ?? 0,
            icon: <CheckCircle2 className="size-4" />,
        },
        {
            label: "Superseded",
            value: stats?.superseded ?? 0,
            icon: <BrainCircuit className="size-4" />,
        },
        {
            label: "Autogenerados",
            value: stats?.bySource?.pr ?? 0,
            icon: <Sparkles className="size-4" />,
        },
    ];

    return (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {cards.map((card) => (
                <Card key={card.label}>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-muted-foreground text-sm font-medium">
                            {card.label}
                        </CardTitle>
                        {card.icon}
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">
                            {isLoading ? "…" : card.value}
                        </div>
                    </CardContent>
                </Card>
            ))}
        </div>
    );
}
