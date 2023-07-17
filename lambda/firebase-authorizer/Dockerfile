FROM public.ecr.aws/lambda/python:3.10

COPY requirements.txt clientLibraryConfig-aws-provider.json ./
RUN python3.10 -m pip install -r requirements.txt -t .
ENV GOOGLE_APPLICATION_CREDENTIALS ${LAMBDA_TASK_ROOT}/clientLibraryConfig-aws-provider.json
COPY app.py ./

# Command can be overwritten by providing a different command in the template directly.
CMD ["app.lambda_handler"]
