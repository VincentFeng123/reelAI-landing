import { HTMLAttributes, forwardRef } from "react";

type Props = HTMLAttributes<HTMLDivElement> & {
  strong?: boolean;
};

const FrostedCard = forwardRef<HTMLDivElement, Props>(
  ({ className, strong, children, ...rest }, ref) => (
    <div
      ref={ref}
      className={`${strong ? "frost-strong" : "frost"} rounded-3xl shadow-frost ${className ?? ""}`}
      {...rest}
    >
      {children}
    </div>
  ),
);

FrostedCard.displayName = "FrostedCard";
export default FrostedCard;
