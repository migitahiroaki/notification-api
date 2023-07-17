import firebase_admin
import logging
import os
from firebase_admin import auth


def lambda_handler(event, context):
    logger = logging.getLogger()
    logger.setLevel(str(os.getenv("LOGGING_LEVEL", "INFO")))
    logger.debug(event)
    # sdk初期化
    if not firebase_admin._apps:
        firebase_admin.initialize_app()
    try:
        arn = event["methodArn"]
        jwt: str = str(event["authorizationToken"]).replace("Bearer ", "")
        # 正規のトークンでない場合エラーになる
        decoded_token: dict = auth.verify_id_token(jwt)
        logger.debug(decoded_token)
        # 許可
        response = generate_response(True, decoded_token["uid"], arn)
        logger.debug(response)
        return response
    except (
        auth.InvalidIdTokenError,
        auth.ExpiredIdTokenError,
        auth.RevokedIdTokenError,
        auth.CertificateFetchError,
        auth.UserDisabledError,
    ) as e:
        logging.warn("Authentication Failed")
        logging.error(f"{type(e).__name__}: {str(e.args)}")
        return generate_response()

    except KeyError as e:
        logging.warn("Bad Request")
        logging.error(f"{type(e).__name__}: {str(e.args)}")
        return generate_response()
    except Exception as e:
        logging.error("Unhandled Exception")
        logging.error(f"{type(e).__name__}: {str(e.args)}")
        return generate_response()


def generate_response(
    allow=False, principal_id="0", arn="arn:aws:execute-api:*:*:*/*/*/"
):
    return {
        "principalId": principal_id,
        "policyDocument": {
            "Version": "2012-10-17",
            "Statement": [
                {
                    "Action": "*",
                    "Effect": "Allow" if allow else "Deny",
                    "Resource": arn,
                }
            ],
        },
    }
