import {
  Button,
  Checkbox,
  Col,
  Divider,
  Flex,
  Form,
  Input,
  message,
  Row,
  theme,
  Typography,
} from 'antd';
import {
  FacebookFilled,
  GoogleOutlined,
  TwitterOutlined,
} from '@ant-design/icons';
import { Logo } from '../../components';
import { useMediaQuery } from 'react-responsive';
import {PATH_AUTH, PATH_CONSOLE} from '../../constants';
import { useNavigate } from 'react-router-dom';
import { useState } from 'react';
import {authLoginThunk, authSignUpThunk, UserState} from "../../store";
import {useAppDispatch} from "../../store/useAppDispatch";
import {PATH_LOGIN} from "../../constants/routes";

const { Title, Text, Link } = Typography;

type FieldType = {
  name?: string;
  email?: string;
  password?: string;
  cPassword?: string;
  terms?: boolean;
};

const SignUpPage = () => {
  const {
    token: { colorPrimary },
  } = theme.useToken();
  const isMobile = useMediaQuery({ maxWidth: 769 });
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);

  const dispatch = useAppDispatch();
  const onFinish = async (values: any) => {
    console.log('Success:', values);
    setLoading(true);
    const rez = await dispatch(
        authSignUpThunk({
          username: values.name,
          password: values.password,
          email:values.email,
        })
    );
    console.log("R", rez);
    setLoading(false);
    if ((rez.payload as UserState).username) {
      message.open({
        type: 'success',
        content: 'Account signup successful',
      });
      navigate(PATH_LOGIN);
    } else {
      message.open({
        type: 'error',
        content: (rez.payload as {error:string}).error || 'User account is not created',
      });
    }


  };

  const onFinishFailed = (errorInfo: any) => {
    console.log('Failed:', errorInfo);
  };

  return (
    <Row style={{ minHeight: isMobile ? 'auto' : '100vh', overflow: 'hidden' }}>
      <Col xs={24} lg={12}>
        <Flex
          vertical
          align="center"
          justify="center"
          className="text-center"
          style={{ background: colorPrimary, height: '100%', padding: '1rem' }}
        >
          <Logo color="yellow" />
          <Title level={2} className="text-white">
            Porfolio System
          </Title>
          <Text className="text-white" style={{ fontSize: 18 }}>
            PS Console and Administrator
          </Text>
        </Flex>
      </Col>
      <Col xs={24} lg={12}>
        <Flex
          vertical
          align={isMobile ? 'center' : 'flex-start'}
          justify="center"
          gap="middle"
          style={{ height: '100%', padding: '2rem' }}
        >
          <Title className="m-0">Create an account</Title>
          <Flex gap={4}>
            <Text>Already have an account?</Text>
            <Link href={PATH_AUTH.signin}>Sign in here</Link>
          </Flex>

          <Form
            name="sign-up-form"
            layout="vertical"
            labelCol={{ span: 8 }}
            wrapperCol={{ span: 24 }}
            initialValues={{ remember: true }}
            onFinish={onFinish}
            onFinishFailed={onFinishFailed}
            autoComplete="off"
            requiredMark={false}
          >
            <Row gutter={[8, 0]}>
              <Col xs={24} >
                <Form.Item<FieldType>
                  label="Name"
                  name="name"
                  rules={[
                    {
                      required: true,
                      message: 'Please input your  name!',
                    },
                  ]}
                >
                  <Input />
                </Form.Item>
              </Col>

              <Col xs={24}>
                <Form.Item<FieldType>
                  label="Email"
                  name="email"
                  rules={[
                    { required: true, message: 'Please input your email' },
                  ]}
                >
                  <Input />
                </Form.Item>
              </Col>
              <Col xs={24}>
                <Form.Item<FieldType>
                  label="Password"
                  name="password"
                  rules={[
                    { required: true, message: 'Please input your password!' },
                  ]}
                >
                  <Input.Password />
                </Form.Item>
              </Col>
              <Col xs={24}>
                <Form.Item<FieldType>
                  label="Confirm password"
                  name="cPassword"
                  rules={[
                    {
                      required: true,
                      message: 'Please ensure passwords match!',
                    },
                  ]}
                >
                  <Input.Password />
                </Form.Item>
              </Col>
              <Col xs={24}>
                <Form.Item<FieldType> name="terms" valuePropName="checked">
                  <Flex>
                    <Checkbox>I agree to</Checkbox>
                    <Link>terms and conditions</Link>
                  </Flex>
                </Form.Item>
              </Col>
            </Row>
            <Form.Item>
              <Button
                type="primary"
                htmlType="submit"
                size="middle"
                loading={loading}
              >
                Submit
              </Button>
            </Form.Item>
          </Form>
        </Flex>
      </Col>
    </Row>
  );
};

export default SignUpPage;
