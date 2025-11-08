function checkRoles(...allowedRoles) {
  return (req, res, next) => {
    try {
      const role =
        req.user?.role || req.user?.user_role || req.body?.user_role || null;

      if (!role) {
        return res
          .status(401)
          .json({ error: "User role missing or unauthorized" });
      }

      if (!allowedRoles.includes(role)) {
        return res.status(403).json({ error: "Access denied" });
      }

      next();
    } catch (err) {
      console.error("Role check failed:", err);
      res.status(403).json({ error: "Access denied" });
    }
  };
}

module.exports = checkRoles;
