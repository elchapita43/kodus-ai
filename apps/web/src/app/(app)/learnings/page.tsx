"use client";

import { BrainCircuit } from "lucide-react";

import { Page } from "@components/ui/page";

import { CreateLearningButton } from "./_components/create-learning";
import { LearningsList } from "./_components/learnings-list";
import { LearningsStats } from "./_components/learning-stats";

export default function LearningsPage() {
    return (
        <Page.Root>
            <Page.Content>
                <div className="flex flex-col gap-6">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="flex items-center gap-2">
                            <BrainCircuit className="size-6" />
                            <h1 className="text-xl font-semibold">Learnings</h1>
                        </div>
                        <CreateLearningButton />
                    </div>
                    <LearningsStats />
                    <LearningsList />
                </div>
            </Page.Content>
        </Page.Root>
    );
}
