import io
import unittest
from unittest.mock import patch

from fastapi.testclient import TestClient
from PIL import Image

from app import app
from inference import runner


class InferenceEndpointTests(unittest.TestCase):
    def setUp(self):
        self.client = TestClient(app)
        image = Image.new("RGB", (2, 2), (12, 34, 56))
        buffer = io.BytesIO()
        image.save(buffer, format="PNG")
        self.image = buffer.getvalue()

    def test_rejects_unknown_model(self):
        response = self.client.post("/predict", data={"model": "other"}, files={"file": ("a.png", self.image, "image/png")})
        self.assertEqual(response.status_code, 400)

    def test_returns_probability_png_data_url(self):
        with patch.object(runner, "predict", return_value=(self.image, 2, 2, 3.0)) as predict:
            response = self.client.post("/predict", data={"model": "TUT"}, files={"file": ("a.png", self.image, "image/png")})

        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.json()["mask"].startswith("data:image/png;base64,"))
        self.assertEqual(response.json()["width"], 2)
        predict.assert_called_once_with(self.image, "TUT")


if __name__ == "__main__":
    unittest.main()
