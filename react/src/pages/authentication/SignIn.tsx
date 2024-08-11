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
} from "antd";
import {
  FacebookFilled,
  GoogleOutlined,
  TwitterOutlined,
} from "@ant-design/icons";
import Logo from "../../components/Logo";
import { useMediaQuery } from "react-responsive";
import { PATH_AUTH, PATH_CONSOLE } from "../../constants";
import { useNavigate } from "react-router-dom";
import {useState, useRef, useEffect} from "react";
import { authLoginThunk, updateUser, UserState } from "../../store";
import { useAppDispatch } from "../../store/useAppDispatch";
import { Link as Link2 } from "react-router-dom";


const { Title, Text, Link } = Typography;

type FieldType = {
  login?: string;
  password?: string;
  remember?: boolean;
};



const SignInPage = () => {
  const {
    token: { colorPrimary },
  } = theme.useToken();
  const isMobile = useMediaQuery({ maxWidth: 769 });
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const loginRef = useRef<any>();

  const dispatch = useAppDispatch();

  useEffect(()=> {

     fetch(`${process.env.REACT_APP_URL_DATA}/check-cookie`, {credentials: 'include'})
        .then(async (response) => {
        console.log('feeeeeeeeetch', response.ok);
          if (response.ok) {
            const jsonData = await response.json();
            console.log('Received JSON data:', jsonData);
            dispatch(updateUser(jsonData));
            navigate(PATH_CONSOLE);
          }
        })
        .catch((err:any) => {
console.log('err', err);
        })
  }, []);
  const onFinish = async (values: any) => {
    console.log("Success:", values);
    setLoading(true);
    const rez = await dispatch(
      authLoginThunk({
        login: values.login,
        password: values.password,
        loading: "pending",
      }),
    );
    console.log("R", rez);
    setLoading(false);
    const { token='', userId='', role='' } = rez.payload as UserState || {};
    if (token) {
      message.open({
        type: "success",
        content: "Login successful",
      });
      // document.cookie =`ps2token=${token};httpOnly=true;secure=true;sameSite='strict'`
      //Cookies.set('ps2token', token, { expires: 5 });
      dispatch(updateUser({ login: values.login, userId, role }));
      if (values.remember) {
        fetch(`${process.env.REACT_APP_URL_DATA}/set-cookie?token=${token}`, {credentials: 'include'})
            .then(response => {
              // Check if the cookie was set correctly
              console.log('COOKIES', document.cookie);

              if (response.ok) {
                console.log('Logged in successfully');
              } else {
                console.error('Login failed');
              }
            })
            .catch(error => {
              console.error('Error:', error);
            });
      }
      navigate(PATH_CONSOLE);
    } else {
      message.open({
        type: "error",
        content: "Login or Passwoard is wrong",
      });
    }
  };

  const onFinishFailed = (errorInfo: any) => {
    console.log("Failed:", errorInfo);
  };



  return (
    <Row style={{ minHeight: isMobile ? "auto" : "100vh", overflow: "hidden" }}>
      <Col xs={24} lg={12}>
        <Flex
          vertical
          align="center"
          justify="center"
          className="text-center"
          style={{ background: colorPrimary, height: "100%", padding: "1rem" }}
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
          align={isMobile ? "center" : "flex-start"}
          justify="center"
          gap="middle"
          style={{ height: "100%", padding: "2rem" }}
        >
          <Title className="m-0">Login</Title>
          <Flex gap={4}>
            <Text>Don't have an account?</Text>
            <Link2 to="/signup">Create an account here</Link2>
          </Flex>
          <Form
            ref={loginRef}
            name="sign-up-form"
            layout="vertical"
            labelCol={{ span: 24 }}
            wrapperCol={{ span: 24 }}
            initialValues={{ remember: true }}
            onFinish={onFinish}
            onFinishFailed={onFinishFailed}
            autoComplete="off"
            requiredMark={false}
          >
            <Row gutter={[8, 0]}>
              <Col xs={24}>
                <Form.Item<FieldType>
                  label="Login"
                  name="login"
                  rules={[
                    { required: true, message: "Please input your login" },
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
                    { required: true, message: "Please input your password!" },
                  ]}
                >
                  <Input.Password />
                </Form.Item>
              </Col>
              <Col xs={24}>
                <Form.Item<FieldType> name="remember" valuePropName="checked">
                  <Checkbox>Remember me</Checkbox>
                </Form.Item>
              </Col>
            </Row>
            <Form.Item>
              <Flex align="center" justify="space-between">
                <div>
                  <Button
                    type="primary"
                    htmlType="submit"
                    size="middle"
                    loading={loading}
                  >
                    Login
                  </Button>

                </div>
                <Link href={PATH_AUTH.passwordReset}>Forgot password?</Link>
              </Flex>
            </Form.Item>
          </Form>
          <Divider className="m-0"></Divider>
          {/* <Flex
            vertical={isMobile}
            gap="small"
            wrap="wrap"
            style={{ width: '100%' }}
          >
            <Button icon={<GoogleOutlined />}>Sign in with Google</Button>
            <Button icon={<FacebookFilled />}>Sign in with Facebook</Button>
            <Button icon={<TwitterOutlined />}>Sign in with Twitter</Button>
          </Flex>*/}
        </Flex>
      </Col>
    </Row>
  );
};

export default SignInPage;
