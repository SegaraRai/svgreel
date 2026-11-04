import type { ReactNode, SVGProps } from "react";

export interface OnceProps extends SVGProps<SVGGElement> {
  children: ReactNode;
}

/**
 * Animations inside play a single time and then hold their last frame, while the rest of the
 * composition keeps looping. Use it for intros such as a title that rises in and stays.
 */
export function Once({ children, ...rest }: OnceProps) {
  return (
    <g {...rest} data-once="">
      {children}
    </g>
  );
}
