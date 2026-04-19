from __future__ import annotations

from pathlib import Path

from huggingface_hub import snapshot_download


def main() -> None:
	repo_id = "AxonData/face-anti-spoofing-dataset"
	out_dir = Path("dataset") / "anti-spoofing" / "AxonData"
	out_dir.mkdir(parents=True, exist_ok=True)

	# Download the raw repository files instead of Arrow cache files.
	snapshot_download(
		repo_id=repo_id,
		repo_type="dataset",
		local_dir=out_dir.as_posix(),
	)
	print(f"Downloaded to: {out_dir}")


if __name__ == "__main__":
	main()
