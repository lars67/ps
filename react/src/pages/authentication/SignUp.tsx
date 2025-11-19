import {
  AutoComplete,
  Button,
  Checkbox,
  Col,
  Divider,
  Flex,
  Form,
  Input,
  message,
  Row,
  Select,
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
import {useState} from 'react';
import {authLoginThunk, authSignUpThunk, UserState} from "../../store";
import {useAppDispatch} from "../../store/useAppDispatch";
import {PATH_LOGIN} from "../../constants/routes";
import { Link as Link2 } from 'react-router-dom'
import ReactCountryFlag from 'react-country-flag';

const { Title, Text, Link } = Typography;

const countryOptions = [
  { value: 'Afghanistan', label: <><ReactCountryFlag countryCode='AF' svg /> Afghanistan</> },
  { value: 'Albania', label: <><ReactCountryFlag countryCode='AL' svg /> Albania</> },
  { value: 'Algeria', label: <><ReactCountryFlag countryCode='DZ' svg /> Algeria</> },
  { value: 'Argentina', label: <><ReactCountryFlag countryCode='AR' svg /> Argentina</> },
  { value: 'Australia', label: <><ReactCountryFlag countryCode='AU' svg /> Australia</> },
  { value: 'Austria', label: <><ReactCountryFlag countryCode='AT' svg /> Austria</> },
  { value: 'Bangladesh', label: <><ReactCountryFlag countryCode='BD' svg /> Bangladesh</> },
  { value: 'Belgium', label: <><ReactCountryFlag countryCode='BE' svg /> Belgium</> },
  { value: 'Brazil', label: <><ReactCountryFlag countryCode='BR' svg /> Brazil</> },
  { value: 'Canada', label: <><ReactCountryFlag countryCode='CA' svg /> Canada</> },
  { value: 'China', label: <><ReactCountryFlag countryCode='CN' svg /> China</> },
  { value: 'Denmark', label: <><ReactCountryFlag countryCode='DK' svg /> Denmark</> },
  { value: 'Egypt', label: <><ReactCountryFlag countryCode='EG' svg /> Egypt</> },
  { value: 'Finland', label: <><ReactCountryFlag countryCode='FI' svg /> Finland</> },
  { value: 'France', label: <><ReactCountryFlag countryCode='FR' svg /> France</> },
  { value: 'Germany', label: <><ReactCountryFlag countryCode='DE' svg /> Germany</> },
  { value: 'Greece', label: <><ReactCountryFlag countryCode='GR' svg /> Greece</> },
  { value: 'India', label: <><ReactCountryFlag countryCode='IN' svg /> India</> },
  { value: 'Indonesia', label: <><ReactCountryFlag countryCode='ID' svg /> Indonesia</> },
  { value: 'Ireland', label: <><ReactCountryFlag countryCode='IE' svg /> Ireland</> },
  { value: 'Italy', label: <><ReactCountryFlag countryCode='IT' svg /> Italy</> },
  { value: 'Japan', label: <><ReactCountryFlag countryCode='JP' svg /> Japan</> },
  { value: 'Jordan', label: <><ReactCountryFlag countryCode='JO' svg /> Jordan</> },
  { value: 'Kenya', label: <><ReactCountryFlag countryCode='KE' svg /> Kenya</> },
  { value: 'Luxembourg', label: <><ReactCountryFlag countryCode='LU' svg /> Luxembourg</> },
  { value: 'Mexico', label: <><ReactCountryFlag countryCode='MX' svg /> Mexico</> },
  { value: 'Morocco', label: <><ReactCountryFlag countryCode='MA' svg /> Morocco</> },
  { value: 'Netherlands', label: <><ReactCountryFlag countryCode='NL' svg /> Netherlands</> },
  { value: 'New Zealand', label: <><ReactCountryFlag countryCode='NZ' svg /> New Zealand</> },
  { value: 'Norway', label: <><ReactCountryFlag countryCode='NO' svg /> Norway</> },
  { value: 'Pakistan', label: <><ReactCountryFlag countryCode='PK' svg /> Pakistan</> },
  { value: 'Philippines', label: <><ReactCountryFlag countryCode='PH' svg /> Philippines</> },
  { value: 'Poland', label: <><ReactCountryFlag countryCode='PL' svg /> Poland</> },
  { value: 'Portugal', label: <><ReactCountryFlag countryCode='PT' svg /> Portugal</> },
  { value: 'Russia', label: <><ReactCountryFlag countryCode='RU' svg /> Russia</> },
  { value: 'Saudi Arabia', label: <><ReactCountryFlag countryCode='SA' svg /> Saudi Arabia</> },
  { value: 'South Africa', label: <><ReactCountryFlag countryCode='ZA' svg /> South Africa</> },
  { value: 'South Korea', label: <><ReactCountryFlag countryCode='KR' svg /> South Korea</> },
  { value: 'Spain', label: <><ReactCountryFlag countryCode='ES' svg /> Spain</> },
  { value: 'Sweden', label: <><ReactCountryFlag countryCode='SE' svg /> Sweden</> },
  { value: 'Switzerland', label: <><ReactCountryFlag countryCode='CH' svg /> Switzerland</> },
  { value: 'Thailand', label: <><ReactCountryFlag countryCode='TH' svg /> Thailand</> },
  { value: 'Turkey', label: <><ReactCountryFlag countryCode='TR' svg /> Turkey</> },
  { value: 'Ukraine', label: <><ReactCountryFlag countryCode='UA' svg /> Ukraine</> },
  { value: 'United Arab Emirates', label: <><ReactCountryFlag countryCode='AE' svg /> United Arab Emirates</> },
  { value: 'United Kingdom', label: <><ReactCountryFlag countryCode='GB' svg /> United Kingdom</> },
  { value: 'United States', label: <><ReactCountryFlag countryCode='US' svg /> United States</> },
  { value: 'Vietnam', label: <><ReactCountryFlag countryCode='VN' svg /> Vietnam</> },
];

type FieldType = {
  login?: string;
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
  const [form] = Form.useForm();
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
                      message: 'Please input your country!',
                    },
                  ]}
              >
                <AutoComplete
                  placeholder="Type or select your country"
                  options={countryOptions}
                  filterOption={(inputValue, option) =>
                    (option?.value as string).toUpperCase().includes(inputValue.toUpperCase())
                  }
                />
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
