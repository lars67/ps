import {
  Button,
  Checkbox,
  Col,
  Divider,
  Flex,
  Form,
  Input,
  message,
  Row, Select,
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
import {useEffect, useState} from 'react';
import {authLoginThunk, authSignUpThunk, UserState} from "../../store";
import {useAppDispatch} from "../../store/useAppDispatch";
import {PATH_LOGIN} from "../../constants/routes";
import { Link as Link2 } from 'react-router-dom'
import ReactCountryFlag from 'react-country-flag';
import {safeFetch} from "../../utils/safeFetch";
const { Title, Text, Link } = Typography;

type FieldType = {
  login?: string;
  email?: string;
  password?: string;
  cPassword?: string;
  terms?: boolean;
};

interface CountryA2Type  {
  name: string;
  a2: string;
}
const SignUpPage = () => {
  const {
    token: { colorPrimary },
  } = theme.useToken();
  const isMobile = useMediaQuery({ maxWidth: 769 });
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [form] = Form.useForm();
  const [countries, setCountries] = useState<CountryA2Type[] | []>([])
  const dispatch = useAppDispatch();
  const onFinish = async (values: any) => {
    console.log('Success:', values);
    setLoading(true);
    const rez = await dispatch(
        authSignUpThunk({
          login: values.login,
          password: values.password,
          email:values.email,
          firstName: values.firstName,
          lastName: values.lastName ,
          accountNumber: values.accountNumber,
          telephone: values.telephone,
          country: values.country
        })
    );
    console.log("R", rez);
    setLoading(false);
    if ((rez.payload as UserState).login) {
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

  useEffect(()=> {
     safeFetch<CountryA2Type[]>("countries", {method:'GET'})
         .then ((countries)=> {
    setCountries(countries.data as CountryA2Type[]);
     })
         .catch(error => {
           console.error('Error fetching countries:', error);
         });
    }, [setCountries])
  const onFinishFailed = (errorInfo: any) => {
    console.log('Failed:', errorInfo);
  };

  const validateConfirmPassword = (rule: any, value:string) => {
    const { password } = form.getFieldsValue();
    if (!value || value === password) {
      return Promise.resolve();
    }
    return Promise.reject(new Error('The two passwords that you entered do not match!'));
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
            <Link2 to="PATH_LOGIN">Sign in here</Link2>
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
          form={form}
        >
          <Row gutter={[16, 0]}>
            <Col xs={24} sm={12}>
              <Form.Item
                  label="Login"
                  name="login"
                  rules={[
                    {
                      required: true,
                      message: 'Please input your login!',
                    },
                  ]}
              >
                <Input />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12}>
              <Form.Item
                  label="Email"
                  name="email"
                  rules={[
                    { required: true, message: 'Please input your email' },
                  ]}
              >
                <Input />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12}>
              <Form.Item
                  label="First Name"
                  name="firstName"
                  rules={[
                    {
                      required: true,
                      message: 'Please input your first name!',
                    },
                  ]}
              >
                <Input />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12}>
              <Form.Item
                  label="Last Name"
                  name="lastName"
                  rules={[
                    {
                      required: true,
                      message: 'Please input your last name!',
                    },
                  ]}
              >
                <Input />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12}>
              <Form.Item
                  label="Account Number"
                  name="accountNumber"
                  rules={[
                    {
                      required: true,
                      message: 'Please input your account number!',
                    },
                    {
                      pattern: /^\d{10}$/,
                      message: 'Account number must be 10 digits!',
                    },
                  ]}
              >
                <Input />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12}>
              <Form.Item
                  label="Telephone"
                  name="telephone"
                  rules={[
                    {
                      required: true,
                      message: 'Please input your telephone number!',
                    },
                  ]}
              >
                <Input />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12}>
              <Form.Item
                  label="Password"
                  name="password"
                  rules={[
                    { required: true, message: 'Please input your password!' },
                  ]}
              >
                <Input.Password />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12}>
              <Form.Item
                  label="Confirm Password"
                  name="cPassword"
                  rules={[
                    {
                      required: true,
                      message: 'Please ensure passwords match!',
                    },
                    {
                      validator: validateConfirmPassword,
                    },
                  ]}
              >
                <Input.Password />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12}>
              <Form.Item
                  label="Country"
                  name="country"
                  rules={[
                    {
                      required: true,
                      message: 'Please select your country!',
                    },
                  ]}
              >
                <Select placeholder="Select your country">
                  {countries.map((country) => (
                      <Select.Option key={country.a2} value={country.name}>
                        <ReactCountryFlag countryCode={country.a2} svg /> {country.name}
                      </Select.Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>


            <Col xs={24}>
              <Form.Item name="terms" valuePropName="checked">
                <Checkbox>I agree to</Checkbox>
                <Link href="/terms">terms and conditions</Link>
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
