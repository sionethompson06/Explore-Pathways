import type { SVGProps } from "react";

/**
 * Small, hand-drawn stroke icons -- not a photograph or a third-party
 * icon-font dependency. Always decorative (paired with visible text),
 * so every icon is aria-hidden.
 */
function Icon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      width="1.75rem"
      height="1.75rem"
      aria-hidden="true"
      {...props}
    />
  );
}

export function AthleticsIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Icon {...props}>
      <circle cx="12" cy="4.5" r="1.75" />
      <path d="M12 6.5v5l-3.5 3.5M12 11.5l3.5 3.5M9 21l2.2-4.5M15 21l-2.2-4.5M8.5 9.5 5 11M15.5 9.5 19 11" />
    </Icon>
  );
}

export function ScheduleIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Icon {...props}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5V12l3 2" />
    </Icon>
  );
}

export function HomeschoolIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Icon {...props}>
      <path d="M4 11.5 12 4l8 7.5" />
      <path d="M6 10v9.5h12V10" />
      <path d="M10 19.5v-5h4v5" />
    </Icon>
  );
}

export function AcademicIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Icon {...props}>
      <path d="M3 8 12 4l9 4-9 4-9-4Z" />
      <path d="M7 10.5V16c0 1.4 2.2 2.5 5 2.5s5-1.1 5-2.5v-5.5" />
      <path d="M20 9v6" />
    </Icon>
  );
}

export function CompassIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Icon {...props}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="m14.8 9.2-1.7 4.9-4.9 1.7 1.7-4.9 4.9-1.7Z" />
    </Icon>
  );
}

export function QuestionIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Icon {...props}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M9.8 9.3a2.3 2.3 0 1 1 3.4 2c-.9.5-1.2 1-1.2 1.9" />
      <path d="M12 16.7v.1" />
    </Icon>
  );
}

export function DiscoverIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Icon {...props}>
      <circle cx="10.5" cy="10.5" r="6.5" />
      <path d="m15.5 15.5 4.5 4.5" />
    </Icon>
  );
}

export function ExploreIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Icon {...props}>
      <path d="M12 3.5v2M12 18.5v2M3.5 12h2M18.5 12h2" />
      <circle cx="12" cy="12" r="5.5" />
    </Icon>
  );
}

export function PlanIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Icon {...props}>
      <rect x="5" y="4.5" width="14" height="16" rx="2" />
      <path d="M9 3.5h6v3H9zM8.5 12h7M8.5 15.5h5" />
    </Icon>
  );
}

export function ImplementIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Icon {...props}>
      <path d="M4 12h11M11 7l4.5 5-4.5 5" />
      <path d="M17 7v10" />
    </Icon>
  );
}

export function SupportIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Icon {...props}>
      <path d="M12 20s-7-4.4-7-9.8A4.2 4.2 0 0 1 12 7a4.2 4.2 0 0 1 7 3.2C19 15.6 12 20 12 20Z" />
    </Icon>
  );
}

export function AdvanceIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Icon {...props}>
      <path d="M4 17 9.5 11l3.5 3 6-7" />
      <path d="M15.5 6.5H19V10" />
    </Icon>
  );
}
