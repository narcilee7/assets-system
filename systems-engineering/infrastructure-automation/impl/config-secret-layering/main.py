import os

import yaml


def main():
    config = yaml.safe_load("config/default.yaml")
    print(f"Loaded default config: {config}")
    env = os.environ.get("APP_ENV", "default")
    print(f"Using env: {env}")
    env_config = yaml.safe_load(f"config/{env}.yaml")
    print(f"Loaded env config: {env_config}")


if __name__ == "__main__":
    main()
