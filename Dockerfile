FROM public.ecr.aws/lambda/python:3.10
COPY ./lambda/requirements.txt/ /tmp
ENV GOOGLE_APPLICATION_CREDENTIALS ${LAMBDA_TASK_ROOT}/clientLibraryConfig-aws-provider.json
RUN pip install -r /tmp/requirements.txt
COPY ./lambda/src/* ${LAMBDA_TASK_ROOT}
CMD [ "app.lambda_handler" ]