import React from "react";
import { SvgCodus } from "@components/ui/icons/SvgCodus";
import { Page } from "@components/ui/page";

export default function AuthPageHeader({
    children,
}: {
    children?: React.ReactNode;
}) {
    return (
        <Page.Header className="flex w-full flex-col items-center gap-10">
            <SvgCodus className="h-8" />
            {children}
        </Page.Header>
    );
}
