import React, { Component } from "react";
import { connect } from "react-redux";
import axios from "axios";
import ReactTable from "react-table";
import 'react-table/react-table.css'

class Dashboard extends Component {
    constructor(props){
      super(props);
      this.state = {
        data: [],
        selected: null
      };
      this.componentDidMount = this.componentDidMount.bind(this);
      this.getProjectList = this.getProjectList.bind(this);
    }

    componentDidMount() {
      fetch('/api/getClientList')
      .then(res => res.json())
      .then(response => {
        this.setState({
          data: response.clients
        })
      })
    }

    getProjectList(email) {
      this.props.history.push('/projectList/'+email)
    }
    render() {
      const {data} = this.state;

      const columns = [{
        Header: 'Name',
        accessor: 'name'
      }, {
        Header: 'Email',
        accessor: 'email',
      }, {
        Header: 'KYC status',
        accessor: 'kyc_verified'
      }, {
        Header: 'Attempts taken',
        accessor: 'attemptsCount'
      }, {
        Header: 'Go to Project List',
        accessor: 'uniqueId'
      }];
      return (
        <ReactTable
          data={data}
          columns={columns}
          onFetchData={this.fetchData}
          getTrProps ={(state, rowInfo) => {
            if (rowInfo && rowInfo.row) {
              return {
                onClick: (e) => {
                  this.setState({
                    selected: rowInfo.index,
                  })
                  this.getProjectList(rowInfo.original.email)
                },
                style: {
                  background: rowInfo.index === this.state.selected ? '#00afec' : 'white',
                  color: rowInfo.index === this.state.selected ? 'white' : 'black'
                }
              }
            }else{
              return {}
            }
          }}
          />
      );
    }
}

export default Dashboard;