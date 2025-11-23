const jwt = require("jsonwebtoken");

const DEFAULT_FRONTEND =
  process.env.FRONTEND_URL || "https://main.d9mc2v9b3gxgw.amplifyapp.com";

const stripTrailingSlash = (value = "") =>
  value.endsWith("/") ? value.replace(/\/+$/, "") : value;

const ensureLeadingSlash = (value = "") =>
  value.startsWith("/") ? value : `/${value}`;

const getPortalBase = () =>
  stripTrailingSlash(process.env.CUSTOMER_PORTAL_URL || DEFAULT_FRONTEND);

const buildAppointmentLink = (appointmentId) => {
  const base = getPortalBase();
  const path = ensureLeadingSlash(
    process.env.CUSTOMER_APPOINTMENT_PATH || "/customer/appointments"
  ).replace(/\/+$/, "");
  return `${base}${path}/${appointmentId}`;
};

const buildPasswordSetupLink = (userId, email) => {
  const tokenTtl = process.env.CUSTOMER_PORTAL_TOKEN_TTL || "7d";
  const token = jwt.sign(
    { user_id: userId, email, purpose: "customer_portal_setup" },
    process.env.JWT_SECRET,
    { expiresIn: tokenTtl }
  );

  const base = getPortalBase();
  const path = ensureLeadingSlash(
    process.env.CUSTOMER_PASSWORD_SETUP_PATH || "/customer/setup-password"
  );
  const separator = path.includes("?") ? "&" : "?";
  const url = path.includes("token=")
    ? `${base}${path}`
    : `${base}${path}${separator}token=${token}`;

  return { token, url };
};

const buildSignInLink = () => {
  const base = getPortalBase();
  const path = ensureLeadingSlash(
    process.env.CUSTOMER_SIGNIN_PATH || "/sign-in"
  );
  return `${base}${path}`;
};

module.exports = {
  buildAppointmentLink,
  buildPasswordSetupLink,
  buildSignInLink,
  getPortalBase,
};
