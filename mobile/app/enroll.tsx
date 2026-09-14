import React, { useEffect } from "react";
import { useLocalSearchParams, useRouter } from "expo-router";
import { EnrollCapture } from "@/components/EnrollCapture";

export default function Enroll() {
  const router = useRouter();
  const { tutorToken } = useLocalSearchParams<{ tutorToken?: string }>();

  useEffect(() => {
    if (!tutorToken) {
      router.replace("/");
    }
  }, [tutorToken, router]);

  if (!tutorToken) {
    return null;
  }

  return <EnrollCapture tutorToken={tutorToken} />;
}
