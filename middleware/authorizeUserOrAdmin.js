function authorizeUserOrAdmin() {
  return (req, res, next) => {
    try {
      const requester = req.user;
      const targetId = parseInt(req.params.id, 10);

      if (!requester) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      if (requester.role === "admin" || requester.id === targetId) {
        return next();
      }

      return res.status(403).json({ error: "Access denied" });
    } catch (err) {
      console.error("Authorization error:", err);
      res.status(403).json({ error: "Access denied" });
    }
  };
}

module.exports = authorizeUserOrAdmin;
