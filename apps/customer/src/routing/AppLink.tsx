import React from "react";
import { Link } from "react-router-dom";
import { normalizeCustomerRouteHref } from "./customerNavigation";

type AppLinkProps = React.AnchorHTMLAttributes<HTMLAnchorElement> & {
  href: string;
};

export const AppLink: React.FC<AppLinkProps> = ({ href, children, target, rel, download, ...props }) => {
  const normalized = normalizeCustomerRouteHref(href);
  if (!normalized || target || rel || download) {
    return (
      <a href={href} target={target} rel={rel} download={download} {...props}>
        {children}
      </a>
    );
  }

  return (
    <Link to={normalized} {...props}>
      {children}
    </Link>
  );
};

export default AppLink;
