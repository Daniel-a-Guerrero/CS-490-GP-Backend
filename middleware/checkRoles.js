function checkRoles(...allowedRoles) {
  const normalizedRoles = allowedRoles.reduce((acc, entry) => {
    if (Array.isArray(entry)) {
      return acc.concat(entry);
    }
    if (entry) {
      acc.push(entry);
    }
    return acc;
  }, []);

  return (req, res, next) => {
    try {
      const role =
        req.user?.role || req.user?.user_role || req.body?.user_role || null;

      if (!role) {
        return res
          .status(401)
          .json({ error: "User role missing or unauthorized" });
      }

      if (!normalizedRoles.includes(role)) {
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
