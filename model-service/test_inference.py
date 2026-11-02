import io
import unittest

import numpy as np
from PIL import Image

from inference import MODEL_IDS, prepare_image, probability_png


class InferenceImageTests(unittest.TestCase):
    def test_prepare_image_normalizes_rgb_to_model_input(self):
        image = Image.new("RGB", (4, 2), (255, 0, 128))
        source = io.BytesIO()
        image.save(source, format="PNG")

        tensor, size = prepare_image(source.getvalue())

        self.assertEqual(size, (4, 2))
        self.assertEqual(tensor.shape, (1, 3, 512, 512))
        np.testing.assert_allclose(tensor[0, :, 0, 0], [1, -1, 128 / 127.5 - 1], atol=0.01)

    def test_probability_png_sigmoids_logits_and_restores_image_size(self):
        logits = np.zeros((512, 512), dtype=np.float32)

        png = probability_png(logits, (5, 3))
        decoded = np.asarray(Image.open(io.BytesIO(png)))

        self.assertEqual(decoded.shape, (3, 5))
        self.assertTrue(np.all(decoded == 128))

    def test_rejects_invalid_image(self):
        with self.assertRaises(ValueError):
            prepare_image(b"not an image")

    def test_model_ids_match_five_checkpoint_directories(self):
        self.assertEqual(MODEL_IDS, ("Crack500", "CrackMap", "DeepCrack", "Facade390", "TUT"))


if __name__ == "__main__":
    unittest.main()
