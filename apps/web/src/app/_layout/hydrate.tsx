"use client";
import type { ReactNode } from "react";
import { UAParser } from "ua-parser-js";
import { AtomsHydrator } from "@/lib/jotai-hydrator";
import { userAgentAtom } from "@/store/user-agent";

export const AppAtomsHydrator = ({
  children,
  userAgent,
}: {
  children: ReactNode;
  userAgent: string;
}) => {
  return (
    <AtomsHydrator
      atomValues={[[userAgentAtom, new UAParser(userAgent)]]}
      dangerouslyForceHydrate
    >
      {children}
    </AtomsHydrator>
  );
};
