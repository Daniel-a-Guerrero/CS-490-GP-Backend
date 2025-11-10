//photos/controller.js
const photoService = require("./service");

exports.addServicePhoto = async (req, res) => {
  try {
    const { appointment_id, staff_id, service_id, photo_type, photo_url } = req.body;
    const user_id = req.user.user_id || req.user.id;

    const photo_id = await photoService.addServicePhoto(appointment_id, user_id, staff_id, service_id, photo_type, photo_url);
    res.json({ message: "Photo uploaded", photo_id });
  } catch (err) {
    console.error("Photo error:", err);
    res.status(500).json({ error: err.message });
  }
};

exports.getServicePhotos = async (req, res) => {
  try {
    const appointment_id = req.params.appointment_id;
    const photos = await photoService.getServicePhotos(appointment_id);
    res.json({ photos });
  } catch (err) {
    console.error("Get photos error:", err);
    res.status(500).json({ error: err.message });
  }
};

