import type { Metadata } from "next";
import { BackgroundAudioProvider } from "@/components/BackgroundAudioProvider";

export const metadata: Metadata = {
  title: "Chronospectra | SPHEREx Observatory",
  description: "Explore SPHEREx epochs, near-infrared spectra, and candidate changes.",
};

export default function ObservatoryLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <BackgroundAudioProvider>{children}</BackgroundAudioProvider>;
}