import { Button } from 'antd';
import { CloseOutlined } from '@ant-design/icons';
import { ButtonProps } from 'antd/es/button/button';

interface CloseableButtonProps extends ButtonProps {
    onClick: () => void;
}

const CloseBtn: React.FC<CloseableButtonProps> = ({ color, onClick, ...rest }) => {
    return (
        <Button
            icon={<CloseOutlined />}
            onClick={onClick}
            style={{ color }}
            {...rest}
        >
            Close
        </Button>
    );
};

export default CloseBtn;
